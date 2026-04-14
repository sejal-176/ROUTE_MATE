import os
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
import httpx 
from dotenv import load_dotenv
from services.geo_service import calculate_geohash, haversine_distance
from services.matching_service import calculate_heuristic_score

load_dotenv() 

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SUPABASE_ANON_KEY")

router = APIRouter()

def get_headers():
    if not SUPABASE_URL or not SUPABASE_KEY:
        raise HTTPException(status_code=500, detail="Supabase credentials not configured.")
    return {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=representation"
    }

class NearbyRequest(BaseModel):
    lat: float
    lng: float
    radius_km: float = 0.5 # Default is small, but frontend can override
    user_id: Optional[str] = None
    dest_lat: Optional[float] = None
    dest_lng: Optional[float] = None
    search_date: Optional[str] = None
    search_time: Optional[str] = None
    
class MatchRequest(BaseModel):
    pool_id: str

class RequestResponse(BaseModel):
    status: str

@router.post("/pools/nearby")
async def get_nearby_pools(req: NearbyRequest):
    headers = get_headers()
    try:
        async with httpx.AsyncClient() as client:
            pool_endpoint = f"{SUPABASE_URL}/rest/v1/pools"
            base_params = {
                # Only show pools that are currently available for ride matching.
                # Do not include completed or dissolved pools in the nearby listing.
                "status": "in.(open,active,full)"
            }

            if req.radius_km > 0:
                geohash_prefix = calculate_geohash(req.lat, req.lng, precision=4)
                params = {**base_params, "source_geohash": f"like.{geohash_prefix}%"}
                response = await client.get(pool_endpoint, headers=headers, params=params)
                response.raise_for_status()
                pools = response.json()
                if not pools:
                    response = await client.get(pool_endpoint, headers=headers, params=base_params)
                    response.raise_for_status()
                    pools = response.json()
            else:
                response = await client.get(pool_endpoint, headers=headers, params=base_params)
                response.raise_for_status()
                pools = response.json()
        
        # 2. GLOBAL VIEW LOGIC
        # If radius is 0 or less, we skip distance filtering entirely for testing
        if req.radius_km <= 0:
            for p in pools:
                # Still calculate distance for display purposes, but don't filter
                dist = haversine_distance(req.lat, req.lng, float(p['source_lat']), float(p['source_lng']))
                p['distance_km'] = round(dist, 2)
            return {"pools": pools}

        nearby_pools = []
        for p in pools:
            dist = haversine_distance(req.lat, req.lng, float(p['source_lat']), float(p['source_lng']))
            
            # 3. RADIUS FILTER
            if dist <= req.radius_km:
                # 4. Optional Time/Date/Dest Filters
                if req.search_date:
                    pool_date = p.get('time_window_start', '').split('T')[0]
                    if pool_date != req.search_date:
                        continue
                if req.dest_lat and req.dest_lng:
                    dest_dist = haversine_distance(req.dest_lat, req.dest_lng, float(p.get('dest_lat', 0)), float(p.get('dest_lng', 0)))
                    if dest_dist > req.radius_km:
                        continue
                        
                p['distance_km'] = round(dist, 2)
                nearby_pools.append(p)
                
        # Sort by distance
        nearby_pools.sort(key=lambda x: x.get('distance_km', 0))
        return {"pools": nearby_pools}
        
    except Exception as e:
        print(f"Error in nearby pools: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/pools/{pool_id}/requests")
async def get_pool_requests_scored(pool_id: str):
    headers = get_headers()
    try:
        async with httpx.AsyncClient() as client:
            # Fetch the pool details
            url_pool = f"{SUPABASE_URL}/rest/v1/pools?id=eq.{pool_id}"
            pool_res = await client.get(url_pool, headers=headers)
            pool_res.raise_for_status()
            pool_data = pool_res.json()
            if not pool_data:
                raise HTTPException(status_code=404, detail="Pool not found")
            pool = pool_data[0]
            
            # Fetch pending requests
            url_req = f"{SUPABASE_URL}/rest/v1/pool_requests?pool_id=eq.{pool_id}&status=eq.pending&select=*"
            req_res = await client.get(url_req, headers=headers)
            req_res.raise_for_status()
            requests = req_res.json() or []

            # Fetch requester profiles for those pending requests
            requester_ids = list({req['requester_id'] for req in requests if 'requester_id' in req})
            profiles = {}
            if requester_ids:
                quoted_ids = ','.join([f'"{requester_id}"' for requester_id in requester_ids])
                url_profiles = f"{SUPABASE_URL}/rest/v1/user_profiles?id=in.({quoted_ids})"
                profile_res = await client.get(url_profiles, headers=headers)
                profile_res.raise_for_status()
                for profile in profile_res.json() or []:
                    profiles[profile['id']] = profile

        scored_requests = []
        for req in requests:
            score = calculate_heuristic_score(
                pool_source=(float(pool['source_lat']), float(pool['source_lng'])),
                pool_dest=(float(pool['dest_lat']), float(pool['dest_lng'])),
                pool_time=pool['time_window_start'],
                req_source=(float(req['requester_source_lat']), float(req['requester_source_lng'])),
                req_dest=(float(req['requester_dest_lat']), float(req['requester_dest_lng'])),
                req_time=req['requester_time']
            )

            req['user_profiles'] = profiles.get(req['requester_id'])
            # Note: Removed iterative DB patches here to resolve the N+1 latency issue. Dynamic calc is enough.
            req['heuristic_score'] = score
            scored_requests.append(req)
            
        scored_requests.sort(key=lambda x: x['heuristic_score'], reverse=True)
        return {"requests": scored_requests}
    
    except Exception as e:
        print(f"Error fetching scored pool requests for pool {pool_id}: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/api/pool_requests/{requestId}/respond")
async def respond_to_pool_request(requestId: str, body: RequestResponse):
    if body.status not in ['accepted', 'rejected']:
        raise HTTPException(status_code=400, detail="Invalid request status")

    headers = get_headers()
    try:
        async with httpx.AsyncClient() as client:
            req_url = f"{SUPABASE_URL}/rest/v1/pool_requests"
            req_res = await client.get(req_url, headers=headers, params={"id": f"eq.{requestId}"})
            req_res.raise_for_status()
            req_data = req_res.json()
            print(f"DEBUG: Supabase returned: {req_data}")
            if not req_data:
                raise HTTPException(status_code=404, detail="Request not found")
            request_record = req_data[0]
            pool_id = request_record['pool_id']

            if body.status == 'accepted':
                pool_url = f"{SUPABASE_URL}/rest/v1/pools"
                pool_res = await client.get(pool_url, headers=headers, params={"id": f"eq.{pool_id}"})
                pool_res.raise_for_status()
                pool_data = pool_res.json()
                if not pool_data:
                    raise HTTPException(status_code=404, detail="Pool not found")
                pool_record = pool_data[0]

                available_seats = int(pool_record.get('available_seats', 0))
                if available_seats <= 0 or pool_record.get('status') == 'full':
                    raise HTTPException(status_code=400, detail="Pool is already full")

                new_seats = available_seats - 1
                pool_update = {'available_seats': new_seats}
                if new_seats <= 0:
                    pool_update['status'] = 'full'

                update_pool_url = f"{SUPABASE_URL}/rest/v1/pools"
                await client.patch(update_pool_url, headers=headers, params={"id": f"eq.{pool_id}"}, json=pool_update)

            update_req_url = f"{SUPABASE_URL}/rest/v1/pool_requests"
            await client.patch(update_req_url, headers=headers, params={"id": f"eq.{requestId}"}, json={"status": body.status})

        return {"status": "ok", "request_id": requestId, "new_status": body.status}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))