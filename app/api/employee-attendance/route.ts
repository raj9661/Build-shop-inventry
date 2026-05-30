import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { validateToken } from '@/app/lib/tokenUtils';


// GET /api/employee-attendance?employeeId=&month=&year=
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer '))
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });

    const token = authHeader.substring(7);
    const decoded = await validateToken(token);
    if (!decoded)
      return NextResponse.json({ success: false, message: 'Invalid token' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const employeeId = searchParams.get('employeeId');
    const month = parseInt(searchParams.get('month') || String(new Date().getMonth() + 1)); // 1-12
    const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()));

    if (!employeeId)
      return NextResponse.json({ success: false, message: 'employeeId required' }, { status: 400 });

    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0, 23, 59, 59);

    const records = await prisma.employeeAttendance.findMany({
      where: {
        employeeId: BigInt(employeeId),
        date: { gte: start, lte: end }
      },
      orderBy: { date: 'asc' }
    });

    return NextResponse.json({
      success: true,
      data: {
        records: records.map(r => ({
          id: Number(r.id),
          date: r.date,
          status: r.status,
          notes: r.notes
        }))
      }
    });
  } catch (error) {
    console.error('[Attendance GET]', error);
    return NextResponse.json({ success: false, message: 'Failed to fetch attendance' }, { status: 500 });
  }
}

// POST /api/employee-attendance — upsert attendance for a date
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer '))
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });

    const token = authHeader.substring(7);
    const decoded = await validateToken(token);
    if (!decoded)
      return NextResponse.json({ success: false, message: 'Invalid token' }, { status: 401 });

    const { employeeId, date, status, notes, shopId } = await req.json();
    if (!employeeId || !date || !shopId)
      return NextResponse.json({ success: false, message: 'employeeId, date, shopId required' }, { status: 400 });

    const dateObj = new Date(date);
    dateObj.setHours(0, 0, 0, 0);

    const finalStatus = status || 'present';
    let hoursWorked = 8;
    if (finalStatus === 'half_day') hoursWorked = 4;
    if (finalStatus === 'absent') hoursWorked = 0;

    const record = await prisma.employeeAttendance.upsert({
      where: { employeeId_date: { employeeId: BigInt(employeeId), date: dateObj } },
      create: {
        employeeId: BigInt(employeeId),
        date: dateObj,
        status: finalStatus,
        hoursWorked: hoursWorked,
        notes: notes || null,
        shopId: BigInt(shopId),
      },
      update: {
        status: finalStatus,
        hoursWorked: hoursWorked,
        notes: notes || null,
      }
    });

    return NextResponse.json({
      success: true,
      data: { id: Number(record.id), date: record.date, status: record.status }
    });
  } catch (error) {
    console.error('[Attendance POST]', error);
    return NextResponse.json({ success: false, message: 'Failed to save attendance' }, { status: 500 });
  }
}
