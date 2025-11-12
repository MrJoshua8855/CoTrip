/**
 * Link Parser Utility
 * Extracts metadata from accommodation booking URLs (Airbnb, VRBO, Booking.com)
 */

export interface LinkMetadata {
  title?: string;
  price?: number;
  location?: string;
  imageUrl?: string;
  source: 'airbnb' | 'vrbo' | 'booking' | 'other' | 'invalid';
  listingId?: string;
  currency?: string;
  bedrooms?: number;
  guests?: number;
}

/**
 * Parse accommodation link and extract metadata
 */
export async function parseAccommodationLink(url: string): Promise<LinkMetadata> {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();

    if (hostname.includes('airbnb')) {
      return await parseAirbnbLink(url, urlObj);
    } else if (hostname.includes('vrbo')) {
      return await parseVrboLink(url, urlObj);
    } else if (hostname.includes('booking')) {
      return await parseBookingLink(url, urlObj);
    }

    return {
      source: 'other',
    };
  } catch (error) {
    console.error('Error parsing link:', error);
    return {
      source: 'invalid',
    };
  }
}

/**
 * Parse Airbnb URL
 * Example: https://www.airbnb.com/rooms/12345678
 */
async function parseAirbnbLink(url: string, urlObj: URL): Promise<LinkMetadata> {
  try {
    // Extract listing ID from URL
    const match = url.match(/\/rooms\/(\d+)/);
    const listingId = match ? match[1] : undefined;

    // Basic metadata extraction from URL
    const metadata: LinkMetadata = {
      source: 'airbnb',
      listingId,
    };

    // In a production environment, you would:
    // 1. Use Airbnb's API (if available with proper credentials)
    // 2. Or use a web scraping service
    // 3. Or fetch the page and parse Open Graph tags

    // For now, we'll attempt to extract from URL params if present
    const searchParams = urlObj.searchParams;
    const adults = searchParams.get('adults');
    const children = searchParams.get('children');

    if (adults || children) {
      metadata.guests = parseInt(adults || '0') + parseInt(children || '0');
    }

    // Try to fetch Open Graph metadata
    try {
      const ogData = await fetchOpenGraphData(url);
      if (ogData) {
        metadata.title = ogData.title;
        metadata.imageUrl = ogData.image;
        metadata.location = ogData.location;

        // Try to extract price from description
        const priceMatch = ogData.description?.match(/\$(\d+(?:,\d{3})*(?:\.\d{2})?)/);
        if (priceMatch) {
          metadata.price = parseFloat(priceMatch[1].replace(',', ''));
          metadata.currency = 'USD';
        }
      }
    } catch (ogError) {
      console.warn('Could not fetch Open Graph data:', ogError);
    }

    return metadata;
  } catch (error) {
    console.error('Error parsing Airbnb link:', error);
    return { source: 'airbnb' };
  }
}

/**
 * Parse VRBO URL
 * Example: https://www.vrbo.com/1234567
 */
async function parseVrboLink(url: string, urlObj: URL): Promise<LinkMetadata> {
  try {
    // Extract listing ID from URL
    const match = url.match(/\/(\d+)/);
    const listingId = match ? match[1] : undefined;

    const metadata: LinkMetadata = {
      source: 'vrbo',
      listingId,
    };

    // Try to fetch Open Graph metadata
    try {
      const ogData = await fetchOpenGraphData(url);
      if (ogData) {
        metadata.title = ogData.title;
        metadata.imageUrl = ogData.image;
        metadata.location = ogData.location;

        // VRBO typically shows price in title or description
        const priceMatch = ogData.title?.match(/\$(\d+(?:,\d{3})*(?:\.\d{2})?)/);
        if (priceMatch) {
          metadata.price = parseFloat(priceMatch[1].replace(',', ''));
          metadata.currency = 'USD';
        }
      }
    } catch (ogError) {
      console.warn('Could not fetch Open Graph data:', ogError);
    }

    return metadata;
  } catch (error) {
    console.error('Error parsing VRBO link:', error);
    return { source: 'vrbo' };
  }
}

/**
 * Parse Booking.com URL
 * Example: https://www.booking.com/hotel/us/example-hotel.html
 */
async function parseBookingLink(url: string, urlObj: URL): Promise<LinkMetadata> {
  try {
    const metadata: LinkMetadata = {
      source: 'booking',
    };

    // Try to fetch Open Graph metadata
    try {
      const ogData = await fetchOpenGraphData(url);
      if (ogData) {
        metadata.title = ogData.title;
        metadata.imageUrl = ogData.image;
        metadata.location = ogData.location;
      }
    } catch (ogError) {
      console.warn('Could not fetch Open Graph data:', ogError);
    }

    return metadata;
  } catch (error) {
    console.error('Error parsing Booking.com link:', error);
    return { source: 'booking' };
  }
}

/**
 * Fetch Open Graph metadata from a URL
 * This is a simplified version - in production, use a proper scraping service
 */
async function fetchOpenGraphData(url: string): Promise<{
  title?: string;
  image?: string;
  description?: string;
  location?: string;
} | null> {
  try {
    // In a real implementation, you would:
    // 1. Use a service like Microlink, Urlbox, or similar
    // 2. Or implement server-side scraping with cheerio
    // 3. Handle CORS properly (this needs to be server-side)

    // For now, return null and rely on manual input
    // This function signature is here for future implementation
    return null;
  } catch (error) {
    console.error('Error fetching Open Graph data:', error);
    return null;
  }
}

/**
 * Validate if a URL is from a supported accommodation provider
 */
export function isSupportedAccommodationUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();
    return (
      hostname.includes('airbnb') ||
      hostname.includes('vrbo') ||
      hostname.includes('booking')
    );
  } catch {
    return false;
  }
}

/**
 * Get provider name from URL
 */
export function getProviderFromUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();

    if (hostname.includes('airbnb')) return 'Airbnb';
    if (hostname.includes('vrbo')) return 'VRBO';
    if (hostname.includes('booking')) return 'Booking.com';

    return 'Other';
  } catch {
    return 'Invalid';
  }
}
