import sqlite3
for path in [r'd:\SPpro\franchise.db', r'd:\SPpro\data\franchise_analytics.db']:
    conn = sqlite3.connect(path)
    cur = conn.cursor()
    tables = cur.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()
    print('DB:', path, '-> Tables:', [t[0] for t in tables])
    for t in tables:
        cols = cur.execute(f"PRAGMA table_info({t[0]})").fetchall()
        print(f"  {t[0]}: {[c[1] for c in cols]}")
        row = cur.execute(f"SELECT * FROM {t[0]} LIMIT 1").fetchone()
        print(f"   sample: {row}")
    conn.close()
