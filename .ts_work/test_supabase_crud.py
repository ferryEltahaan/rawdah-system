import urllib.request
import json
import ssl
import uuid

BASE_URL = "https://aeuavoqhrhzsxblrddlc.supabase.co/rest/v1"

try:
    HEADERS = dict(__AUTH_HEADERS__)
except NameError:
    HEADERS = {
        "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFldWF2b3Focmh6c3hibHJkZGxjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MDM2MDY1MywiZXhwIjoyMTA1OTM2NjUzfQ.l3yyAef3pJIIGpJS_4zHfLeTINm_-QYYLyHSQNgYvxI",
        "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFldWF2b3Focmh6c3hibHJkZGxjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MDM2MDY1MywiZXhwIjoyMTA1OTM2NjUzfQ.l3yyAef3pJIIGpJS_4zHfLeTINm_-QYYLyHSQNgYvxI"
    }

if "apikey" not in HEADERS:
    HEADERS["apikey"] = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFldWF2b3Focmh6c3hibHJkZGxjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MDM2MDY1MywiZXhwIjoyMTA1OTM2NjUzfQ.l3yyAef3pJIIGpJS_4zHfLeTINm_-QYYLyHSQNgYvxI"

HEADERS["Content-Type"] = "application/json"
HEADERS["Prefer"] = "return=representation"

def test_supabase_customer_lifecycle():
    ctx = ssl.create_default_context()
    test_id = str(uuid.uuid4())
    cust_data = {
        "id": test_id,
        "full_name": "عميل اختبار تلقائي TestSprite",
        "whatsapp_number": "01099887766",
        "nickname": "TestSprite Bot",
        "total_orders_count": 1,
        "total_spent": 300,
        "notes": "تم الإنشاء بواسطة اختبار TestSprite الآلي"
    }

    # 1. Create customer
    req = urllib.request.Request(f"{BASE_URL}/customers", headers=HEADERS, data=json.dumps(cust_data).encode('utf-8'), method="POST")
    with urllib.request.urlopen(req, context=ctx, timeout=15) as resp:
        assert resp.status in (200, 201), f"Failed to create customer: {resp.status}"
        print("[OK] Customer created successfully.")

    # 2. Verify customer exists
    req = urllib.request.Request(f"{BASE_URL}/customers?id=eq.{test_id}", headers=HEADERS, method="GET")
    with urllib.request.urlopen(req, context=ctx, timeout=15) as resp:
        assert resp.status == 200
        items = json.loads(resp.read().decode('utf-8'))
        assert len(items) == 1, "Expected created customer to be found"
        assert items[0]["full_name"] == "عميل اختبار تلقائي TestSprite"
        print("[OK] Customer verified by query.")

    # 3. Clean up test customer
    req = urllib.request.Request(f"{BASE_URL}/customers?id=eq.{test_id}", headers=HEADERS, method="DELETE")
    with urllib.request.urlopen(req, context=ctx, timeout=15) as resp:
        assert resp.status in (200, 204), f"Failed to delete test customer: {resp.status}"
        print("[OK] Test customer cleaned up successfully.")

if __name__ == "__main__":
    test_supabase_customer_lifecycle()
    print("Supabase CRUD lifecycle test passed successfully.")
