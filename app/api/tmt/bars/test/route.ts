import { NextRequest, NextResponse } from 'next/server'

// Test endpoint to verify TMT Bar form works without database
export async function GET(request: NextRequest) {
  try {
    return NextResponse.json({
      success: true,
      message: 'TMT Bar API is working',
      data: {
        testBars: [
          {
            id: 'test-1',
            companyName: 'TATA Tiscon',
            sizeMM: 10,
            bundleSize: 8,
            weightPerPiece: 0.617,
            bundleWeight: 4.936,
            arrivalTons: 5.0,
            totalBundles: 1013,
            totalPieces: 8104,
            sellByWeight: true,
            sellByBundle: false,
            sellByPiece: false,
            mixedLoad: false
          }
        ]
      }
    })
  } catch (error) {
    console.error('Test API error:', error)
    return NextResponse.json(
      { success: false, message: 'Test API failed' },
      { status: 500 }
    )
  }
}
