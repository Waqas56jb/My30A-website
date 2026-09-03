# Transfer flow smoke tests

Admin token, then driver and partner tokens. Replace IDs after each create.

```bash
# 1. Create trip (Rosemary Beach, ECP, 4pax, cash, hired driver, partner 4pax vehicle)
curl -s -X POST http://localhost:4000/api/transfers \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "guest_name": "Test Guest",
    "guest_phone": "8505550100",
    "pickup_address": "Rosemary Beach",
    "dropoff_address": "ECP Airport",
    "community_id": "<ROSEMARY_ID>",
    "airport": "ECP",
    "direction": "to_airport",
    "vehicle_type": "4pax",
    "passengers": 2,
    "bags": 2,
    "scheduled_at": "<ISO_NOW>",
    "driver_id": "<DRIVER_ID>",
    "vehicle_id": "<PARTNER_4PAX_VEHICLE_ID>",
    "payment_method": "cash"
  }'

# 2. Driver list — must NOT include customer_charge
curl -s "http://localhost:4000/api/transfers/mine" \
  -H "Authorization: Bearer $DRIVER_TOKEN"

# 3. Start
curl -s -X POST http://localhost:4000/api/transfers/<TRIP_ID>/start \
  -H "Authorization: Bearer $DRIVER_TOKEN"

# 4. Complete cash 85 + tip 10
curl -s -X POST http://localhost:4000/api/transfers/<TRIP_ID>/complete \
  -H "Authorization: Bearer $DRIVER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"payment_method":"cash","cash_reported":85,"tip_amount":10}'

# Admin detail — owner_fee 17, my30ahost 38, is_flagged false
curl -s http://localhost:4000/api/transfers/<TRIP_ID> \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# 5. Partner vehicle-owner month — owner_fee only, no tip/driver_payout
curl -s "http://localhost:4000/api/transfers/vehicle-owner" \
  -H "Authorization: Bearer $PARTNER_TOKEN"

# 6. Second trip completed with cash_reported 70 → CASH_MISMATCH
curl -s -X POST http://localhost:4000/api/transfers/<TRIP2_ID>/complete \
  -H "Authorization: Bearer $DRIVER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"payment_method":"cash","cash_reported":70,"tip_amount":0}'

# 7. Refund a completed trip
curl -s -X POST http://localhost:4000/api/transfers/<TRIP_ID>/refund \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```
