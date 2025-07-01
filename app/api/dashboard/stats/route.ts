import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    console.log('Fetching dashboard stats...');
    
    // Get counts
    const [
      totalEmirates,
      totalCustomers,
      totalMenuItems,
      totalOrders,
      recentOrders,
      ordersByStatus,
      last7DaysStats
    ] = await Promise.all([
      prisma.emirates.count(),
      prisma.customer.count(),
      prisma.menuItem.count(),
      prisma.order.count(),
      // Get recent orders with customer info and items
      prisma.order.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          customer: true,
          items: {
            include: {
              menuItem: true
            }
          }
        }
      }),
      // Get order counts by status
      prisma.$queryRaw`
        SELECT T1.status, COUNT(T1.id) as count
        FROM "Order" T1
        GROUP BY T1.status
      `,
      // Get last 7 days order stats
      prisma.$queryRaw`
        SELECT 
          DATE(T1."createdAt") as date,
          COUNT(DISTINCT T1.id) as orders,
          COALESCE(SUM(T2.quantity * CAST(T3.price AS DECIMAL)), 0) as revenue
        FROM "Order" T1
        LEFT JOIN "OrderItem" T2 ON T2."orderId" = T1.id
        LEFT JOIN "MenuItem" T3 ON T2."menuItemId" = T3.id
        WHERE T1."createdAt" >= NOW() - INTERVAL '7 days'
        GROUP BY DATE(T1."createdAt")
        ORDER BY date
      `
    ]);

    console.log('Raw data from database:', {
      totalEmirates,
      totalCustomers,
      totalMenuItems,
      totalOrders,
      recentOrdersCount: recentOrders.length,
      ordersByStatus,
      last7DaysStats
    });

    // Format the data
    const formattedRecentOrders = recentOrders.map(order => {
      const total = order.items.reduce((sum, item) => {
        return sum + (parseFloat(item.menuItem.price.toString()) * item.quantity);
      }, 0);

      return {
        id: order.id,
        customerName: order.customer?.name || 'Guest',
        status: order.status,
        total: total,
        createdAt: order.createdAt.toISOString()
      };
    });

    const formattedOrderStats = (last7DaysStats as any[]).map(stat => ({
      date: new Date(stat.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      orders: Number(stat.orders),
      revenue: parseFloat(stat.revenue)
    }));

    const formattedOrdersByStatus = (ordersByStatus as any[]).map(stat => ({
      status: stat.status,
      count: Number(stat.count)
    }));

    const responseData = {
      totalEmirates,
      totalCustomers,
      totalOrders,
      totalMenuItems,
      recentOrders: formattedRecentOrders,
      orderStats: formattedOrderStats,
      orderByStatus: formattedOrdersByStatus
    };

    console.log('Formatted response data:', responseData);

    return NextResponse.json(responseData);

  } catch (error) {
    console.error('Error in stats API:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch dashboard statistics',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
