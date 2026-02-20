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

export default clerkMiddleware(async (auth, req) => {
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
