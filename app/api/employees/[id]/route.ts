import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { validateToken } from '@/app/lib/tokenUtils';
import { getShopFilter } from '@/app/lib/shopAccessUtils';

const prisma = new PrismaClient();

// GET - Get a specific employee with full payment history
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
        shop: { select: { id: true, name: true } },
        payments: { where: { isActive: true }, orderBy: { paymentDate: 'desc' } }
      }
    });

    if (!employee) {
      return NextResponse.json({ success: false, message: 'Employee not found or access denied' }, { status: 404 });
    }

    const totalPaid = employee.payments.reduce((s, p) => s + Number(p.amount), 0);
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const hasPaidThisMonth = employee.payments.some(p => new Date(p.paymentDate) >= monthStart);

    return NextResponse.json({
      success: true,
      data: {
        employee: {
          id: Number(employee.id),
          name: employee.name,
          phone: employee.phone,
          email: employee.email,
          address: employee.address,
          position: employee.position,
          salary: employee.salary,
          salaryType: employee.salaryType,
          paymentDayOfWeek: employee.paymentDayOfWeek,
          joinDate: employee.joinDate,
          notes: employee.notes,
          isActive: employee.isActive,
          shopId: employee.shopId ? Number(employee.shopId) : null,
          shop: employee.shop ? { id: Number(employee.shop.id), name: employee.shop.name } : null,
          totalPaid,
          hasPaidThisMonth,
          paymentHistory: employee.payments.map(p => ({
            id: Number(p.id),
            amount: Number(p.amount),
            paymentDate: p.paymentDate,
            paymentMethod: p.paymentMethod,
            notes: p.notes,
          }))
        }
      }
    });
  } catch (error) {
    console.error('Get employee error:', error);
    return NextResponse.json({ success: false, message: 'Failed to fetch employee' }, { status: 500 });
  }
}


// PUT - Update an employee
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

    const body = await req.json();
    const { name, phone, email, address, salary, positions, joinDate, salaryType, paymentDayOfWeek, notes } = body;

    // Get user's accessible shops
    const shopFilter = await getShopFilter(token);

    // Check if employee exists and user has access
    const existingEmployee = await prisma.employee.findFirst({
      where: {
        id: BigInt(employeeId),
        isActive: true,
        ...shopFilter
      }
    });

    if (!existingEmployee) {
      return NextResponse.json({ success: false, message: 'Employee not found or access denied' }, { status: 404 });
    }

    // Update employee
    const updatedEmployee = await prisma.employee.update({
      where: { id: BigInt(employeeId) },
      data: {
        ...(name && { name }),
        ...(phone !== undefined && { phone }),
        ...(email !== undefined && { email }),
        ...(address !== undefined && { address }),
        ...(salary !== undefined && { salary }),
        ...(positions !== undefined && Array.isArray(positions) && { position: positions.join(',') }),
        ...(joinDate && { joinDate: new Date(joinDate) }),
        ...(salaryType !== undefined && { salaryType }),
        ...(paymentDayOfWeek !== undefined && { paymentDayOfWeek }),
        ...(notes !== undefined && { notes })
      },
      include: {
        shop: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    // Convert BigInt fields to numbers for JSON serialization
    const serializedEmployee = {
      id: Number(updatedEmployee.id),
      name: updatedEmployee.name,
      phone: updatedEmployee.phone,
      email: updatedEmployee.email,
      address: updatedEmployee.address,
      position: updatedEmployee.position,
      salary: updatedEmployee.salary,
      joinDate: updatedEmployee.joinDate,
      isActive: updatedEmployee.isActive,
      shopId: updatedEmployee.shopId ? Number(updatedEmployee.shopId) : null,
      createdAt: updatedEmployee.createdAt,
      updatedAt: updatedEmployee.updatedAt,
      shop: updatedEmployee.shop ? {
        ...updatedEmployee.shop,
        id: Number(updatedEmployee.shop.id)
      } : null
    };

    return NextResponse.json({ 
      success: true, 
      data: { employee: serializedEmployee },
      message: 'Employee updated successfully'
    });
  } catch (error) {
    console.error('Update employee error:', error);
    return NextResponse.json({ success: false, message: 'Failed to update employee' }, { status: 500 });
  }
}

// DELETE - Delete an employee
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

    // Get user's accessible shops
    const shopFilter = await getShopFilter(token);

    // Check if employee exists and user has access
    const existingEmployee = await prisma.employee.findFirst({
      where: {
        id: BigInt(employeeId),
        isActive: true,
        ...shopFilter
      }
    });

    if (!existingEmployee) {
      return NextResponse.json({ success: false, message: 'Employee not found or access denied' }, { status: 404 });
    }

    // Soft delete employee
    await prisma.employee.update({
      where: { id: BigInt(employeeId) },
      data: {
        isActive: false
      }
    });

    return NextResponse.json({ 
      success: true, 
      message: 'Employee deleted successfully'
    });
  } catch (error) {
    console.error('Delete employee error:', error);
    return NextResponse.json({ success: false, message: 'Failed to delete employee' }, { status: 500 });
  }
}

