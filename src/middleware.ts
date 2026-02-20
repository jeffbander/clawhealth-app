import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

const isProtectedRoute = createRouteMatcher([
  '/dashboard(.*)',
  '/patient(.*)',
])

const isProtectedApiRoute = createRouteMatcher([
  '/api/patients(.*)',
  '/api/chat(.*)',
  '/api/vitals(.*)',
  '/api/medications(.*)',
  '/api/alerts(.*)',
  '/api/care-plans(.*)',
  '/api/physician(.*)',
  '/api/voice(.*)',
])

// Twilio webhooks use signature validation, not Clerk auth
const isTwilioRoute = createRouteMatcher(['/api/twilio(.*)'])
// Test setup routes (dev only)
const isTestRoute = createRouteMatcher(['/api/test(.*)'])

export default clerkMiddleware(async (auth, req) => {
  // Skip Clerk auth for Twilio webhooks (they use signature validation)
  if (isTwilioRoute(req)) return NextResponse.next()
  // Skip Clerk auth for test setup routes in development
  if (isTestRoute(req) && process.env.NODE_ENV !== 'production') return NextResponse.next()

  const { userId } = await auth()
  
  if (isProtectedRoute(req) && !userId) {
    const signInUrl = new URL('/sign-in', req.url)
    signInUrl.searchParams.set('redirect_url', req.url)
    return NextResponse.redirect(signInUrl)
  }
  
  if (isProtectedApiRoute(req) && !userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
})

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
