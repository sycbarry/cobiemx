import { NextRequest, NextResponse } from 'next/server';
import odbc from 'odbc';

export async function POST(req: NextRequest) {
  const { hostname, port, database, username, password } = await req.json();
  const connectionString = `DRIVER={IBM DB2 ODBC DRIVER};DATABASE=${database};HOSTNAME=${hostname};UID=${username};PWD=${password};PORT=${port};PROTOCOL=TCPIP`;

  let connection;
  try {
    connection = await odbc.connect(connectionString);
    await connection.query('SELECT 1 FROM SYSIBM.SYSDUMMY1');
    await connection.close();
    return NextResponse.json({ success: true });
  } catch (err) {
    if (connection) await connection.close();
    return NextResponse.json({ success: false, message: err.message });
  }
} 