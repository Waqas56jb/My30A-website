# Grocery flow smoke tests

```bash
# Create shopper + 30% agreement, then:

curl -s -X POST http://localhost:4000/api/grocery \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "guest_name": "Grocery Guest",
    "guest_phone": "8505550200",
    "delivery_address": "123 WaterColor",
    "package": "Full",
    "items": [{"name":"Milk","qty":2},{"name":"Eggs","qty":1},{"name":"Bread","qty":1}],
    "delivery_time": "<ISO_NOW>",
    "shopper_id": "<SHOPPER_ID>",
    "service_fee": 149,
    "payment_method": "card"
  }'

curl -s "http://localhost:4000/api/grocery/mine" \
  -H "Authorization: Bearer $SHOPPER_TOKEN"

curl -s -X POST http://localhost:4000/api/grocery/<ORDER_ID>/shopping \
  -H "Authorization: Bearer $SHOPPER_TOKEN"

curl -s -X POST http://localhost:4000/api/grocery/<ORDER_ID>/on-the-way \
  -H "Authorization: Bearer $SHOPPER_TOKEN"

curl -s -X POST http://localhost:4000/api/grocery/<ORDER_ID>/deliver \
  -H "Authorization: Bearer $SHOPPER_TOKEN" \
  -F grocery_total=312 \
  -F tip_amount=20 \
  -F payment_method=card \
  -F receipt=@receipt.png \
  -F kitchen_photo=@kitchen.png

curl -s http://localhost:4000/api/grocery/<ORDER_ID> \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```
