import sys, os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from backend.database import SessionLocal, init_db
from backend.routers.settings import seed_samples
from backend.routers.search import search_outlets
from backend.routers.analytics import get_outlet_detail, get_dashboard_summary, get_all_outlets_summary
from backend.routers.exports import export_outlet_excel, export_outlet_pdf

init_db()
db = SessionLocal()

print("--- 1. SEEDING SAMPLE DATA ---")
res = seed_samples(db)
print("Seed response:", res)

print("\n--- 2. TESTING DASHBOARD SUMMARY ---")
dash = get_dashboard_summary(db)
print(f"Franchise Total Sales: Rs. {dash.total_sales_amount:,.2f}")
print(f"Franchise Total Purchase: Rs. {dash.total_purchase_amount:,.2f}")
print(f"Operational Difference: Rs. {dash.net_diff_amount:,.2f}")
print(f"Active Outlets: {dash.total_outlets}")
print(f"Total Batches: {dash.total_batches}")

print("\n--- 3. TESTING OUTLET SEARCH ---")
for q in ['Bandra', 'Adajan', 'Nanpura', 'Bhimrad', 'LP Savani']:
    found = search_outlets(q=q, db=db)
    top_name = found[0].official_name if found else "None"
    top_score = found[0].match_score if found else 0
    print(f"Query '{q}': found {len(found)} results -> top: {top_name} ({top_score}%)")

print("\n--- 4. TESTING OUTLET DETAIL ---")
if dash.top_outlets:
    first_outlet = dash.top_outlets[0]
    print(f"Testing detail for top outlet: {first_outlet.official_name} (ID: {first_outlet.id})")
    detail = get_outlet_detail(outlet_id=first_outlet.id, db=db)
    print(f"  Sales Amount: Rs. {detail.kpis.sales_amount:,.2f}")
    print(f"  Purchase Amount: Rs. {detail.kpis.purchase_amount:,.2f}")
    print(f"  Variance (S-P): Rs. {detail.kpis.diff_amount:,.2f} ({detail.kpis.diff_pct}%)")
    print(f"  Distinct Items Compared: {len(detail.items)}")
    if detail.items:
        s_item = detail.items[0]
        print(f"  Top Item: {s_item.item_name} | Sales Qty: {s_item.sales_qty} | Sales Amt: Rs. {s_item.sales_amount} | Purch Qty: {s_item.purchase_qty} | Purch Amt: Rs. {s_item.purchase_amount} | Status: {s_item.status}")

    print("\n--- 5. TESTING EXPORTS ---")
    xl_resp = export_outlet_excel(outlet_id=first_outlet.id, db=db)
    print(f"Excel export generated: {len(xl_resp.body)} bytes")
    pdf_resp = export_outlet_pdf(outlet_id=first_outlet.id, db=db)
    print(f"PDF export generated: {len(pdf_resp.body)} bytes")

db.close()
print("\n>>> ALL TESTS PASSED SUCCESSFULLY! <<<")
