import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/sos/reverse-geocode?lat=X&lng=Y
 * Reverse geocodes GPS coordinates to a human-readable address.
 * Uses OpenStreetMap Nominatim (free, no API key required).
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const lat = searchParams.get('lat');
    const lng = searchParams.get('lng');

    if (!lat || !lng) {
      return NextResponse.json(
        { error: 'Missing lat or lng parameters' },
        { status: 400 }
      );
    }

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);

    if (isNaN(latitude) || isNaN(longitude)) {
      return NextResponse.json(
        { error: 'Invalid lat or lng values' },
        { status: 400 }
      );
    }

    // Validate coordinate ranges
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return NextResponse.json(
        { error: 'Coordinates out of valid range' },
        { status: 400 }
      );
    }

    // Use OpenStreetMap Nominatim for reverse geocoding (free, no API key)
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1&accept-language=fr`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'WEDS-Platform/1.0 (Week-End School Digital - SOS Emergency System)',
      },
      signal: AbortSignal.timeout(8000), // 8 second timeout
    });

    if (!response.ok) {
      // Fallback: return coordinates as string if geocoding fails
      return NextResponse.json({
        address: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
        raw: null,
      });
    }

    const data = await response.json();

    if (data.error || !data.display_name) {
      // Fallback: return formatted coordinates
      return NextResponse.json({
        address: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
        raw: null,
      });
    }

    // Build a concise address from the response
    const address = data.display_name as string;

    return NextResponse.json({
      address,
      raw: {
        city: data.address?.city || data.address?.town || data.address?.village || data.address?.hamlet,
        state: data.address?.state,
        country: data.address?.country,
        countryCode: data.address?.country_code,
        road: data.address?.road,
        postcode: data.address?.postcode,
      },
    });
  } catch (error) {
    console.error('Reverse geocoding error:', error);
    return NextResponse.json(
      { error: 'Reverse geocoding failed', address: null },
      { status: 500 }
    );
  }
}
