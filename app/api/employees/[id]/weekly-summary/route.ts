import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { validateToken } from '@/app/lib/tokenUtils';
import { getShopFilter } from '@/app/lib/shopAccessUtils';

const prisma = new PrismaClient();

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, message: 'Access token required' }, { status: 401 });
    }
    const token = authHeader.substring(7);
    const decoded = await validateToken(token);
    if (!decoded) {
      return NextResponse.json({ success: false, message: 'Invalid or expired token' }, { status: 401 });
    }

    const { id } = await params;
    const employeeId = parseInt(id);
    if (isNaN(employeeId)) {
      return NextResponse.json({ success: false, message: 'Invalid employee ID' }, { status: 400 });
    }

    const shopFilter = await getShopFilter(token);

    const employee = await prisma.employee.findFirst({
      where: { id: BigInt(employeeId), isActive: true, ...shopFilter },
      include: {
        attendances: { orderBy: { date: 'asc' } },
        payments: { where: { isActive: true } }
      }
    });

    if (!employee) {
      return NextResponse.json({ success: false, message: 'Employee not found' }, { status: 404 });
    }

    // Group attendances by ISO week (Monday-Sunday)
    const weeksMap = new Map<string, { startDate: Date, endDate: Date, hours: number, isPaid: boolean }>();

    // Get the start of the week for a given date
    const getWeekStart = (d: Date) => {
      const date = new Date(d);
      const day = date.getDay();
      const diff = date.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
      const start = new Date(date.setDate(diff));
      start.setHours(0, 0, 0, 0);
      return start;
    };

    employee.attendances.forEach(att => {
      const start = getWeekStart(att.date);
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      
      const weekKey = `${start.toISOString().split('T')[0]}_${end.toISOString().split('T')[0]}`;
      
      if (!weeksMap.has(weekKey)) {
        weeksMap.set(weekKey, { startDate: start, endDate: end, hours: 0, isPaid: false });
      }
      
      const weekData = weeksMap.get(weekKey)!;
      weekData.hours += Number(att.hoursWorked) || 0;
    });

    // Check payments to see if week is paid
    // Assuming payments have notes that contain the weekKey, or we do a simple check
    // if a payment was made around that week. For simplicity, we check if any payment date falls within the week or after.
    const weeklySalaries = Array.from(weeksMap.entries()).map(([key, data]) => {
      const weekLabel = `${data.startDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} - ${data.endDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
      
      // Amount calculation
      let amount = 0;
      if (employee.salaryType === 'weekly') {
        amount = Number(employee.salary) || 0;
      } else if (employee.salaryType === 'hourly') {
        amount = data.hours * (Number(employee.salary) || 0);
      } else if (employee.salaryType === 'monthly') {
        // Approximate weekly for monthly
        amount = (Number(employee.salary) || 0) / 4;
      } else if (employee.salaryType === 'daily') {
        amount = (data.hours / 8) * (Number(employee.salary) || 0);
      }

      // Check if paid (Look for a payment with this exact week string in notes, or if there's a payment made on or after the end date of this week that hasn't been assigned yet)
      const isPaid = employee.payments.some(p => p.notes?.includes(weekLabel));

      return {
        weekKey: key,
        week: weekLabel,
        hours: data.hours,
        amount: Math.round(amount),
        status: isPaid ? "paid" : "unpaid",
        startDate: data.startDate.toISOString(),
        endDate: data.endDate.toISOString()
      };
    });

    // Sort by most recent week first
    weeklySalaries.sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());

    return NextResponse.json({
      success: true,
      data: { weeklySalaries }
    });
  } catch (error) {
    console.error('Get weekly summary error:', error);
    return NextResponse.json({ success: false, message: 'Failed to fetch weekly summary' }, { status: 500 });
  }
}
