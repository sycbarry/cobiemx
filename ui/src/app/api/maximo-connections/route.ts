import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const FILE_PATH = path.join(DATA_DIR, 'maximo-connections.json');

async function ensureDataFile() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.access(FILE_PATH);
  } catch {
    // If file doesn't exist, create it with default connection
    const defaultConnections = [
      { name: 'Maximo Dev', id: 'dev', hostname: '', port: '', database: '', username: '', password: '' }
    ];
    await fs.writeFile(FILE_PATH, JSON.stringify(defaultConnections, null, 2));
  }
}

export async function GET() {
  await ensureDataFile();
  const data = await fs.readFile(FILE_PATH, 'utf-8');
  return NextResponse.json(JSON.parse(data));
}

export async function POST(req: NextRequest) {
  await ensureDataFile();
  const body = await req.json();
  const data = await fs.readFile(FILE_PATH, 'utf-8');
  const connections = JSON.parse(data);
  // Assign a unique id if not present
  if (!body.id) {
    body.id = `conn-${Date.now()}`;
  }
  connections.push(body);
  await fs.writeFile(FILE_PATH, JSON.stringify(connections, null, 2));
  return NextResponse.json({ success: true, connection: body });
}

export async function DELETE(req: NextRequest) {
  await ensureDataFile();
  const { id } = await req.json();
  if (!id) return NextResponse.json({ success: false, message: 'Missing id' }, { status: 400 });
  const data = await fs.readFile(FILE_PATH, 'utf-8');
  const connections = JSON.parse(data);
  const filtered = connections.filter((conn: any) => conn.id !== id);
  await fs.writeFile(FILE_PATH, JSON.stringify(filtered, null, 2));
  return NextResponse.json({ success: true });
} 