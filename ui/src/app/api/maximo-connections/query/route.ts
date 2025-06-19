import { NextRequest, NextResponse } from 'next/server';
import odbc from 'odbc';

export async function POST(req: NextRequest) {
  const { sql, connection } = await req.json();
  if (!sql || typeof sql !== 'string' || !sql.trim().toLowerCase().startsWith('select')) {
    return NextResponse.json({ success: false, message: 'Only SELECT queries are allowed.' }, { status: 400 });
  }
  if (!connection) {
    return NextResponse.json({ success: false, message: 'Missing connection info.' }, { status: 400 });
  }
  const { hostname, port, database, username, password } = connection;
  const connectionString = `DRIVER={IBM DB2 ODBC DRIVER};DATABASE=${database};HOSTNAME=${hostname};UID=${username};PWD=${password};PORT=${port};PROTOCOL=TCPIP`;
  let db;
  try {
    db = await odbc.connect(connectionString);
    const result = await db.query(sql);
    await db.close();
    return NextResponse.json({ success: true, rows: result });
  } catch (err) {
    if (db) await db.close();
    return NextResponse.json({ success: false, message: err.message });
  }
} 