'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { getAccessToken } from '@/lib/auth/storage'

export default function Home() {
  const router = useRouter()

  useEffect(() => {
    if (getAccessToken()) router.replace('/dashboard')
    else router.replace('/login')
  }, [router])

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-600">
      Redirigiendo…
    </div>
  )
}
