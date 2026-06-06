import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { token } = await req.json()

    if (!token) {
      return NextResponse.json(
        {
          success: false,
          message: 'Token required',
        },
        { status: 400 },
      )
    }

    const response = await fetch(`https://work.ink/_api/v2/token/isValid/${token}?deleteToken=1`)

    const data = await response.json()

    if (!data.valid) {
      return NextResponse.json(
        {
          success: false,
          message: 'Invalid token',
        },
        { status: 403 },
      )
    }

    return NextResponse.json({
      success: true,
      tokenInfo: data.info,
    })
  } catch {
    return NextResponse.json(
      {
        success: false,
      },
      { status: 500 },
    )
  }
}
