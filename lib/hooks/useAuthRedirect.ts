"use client"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export function useAuthRedirect(authPage = false) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        
        console.log('session', session)
        console.log('authPage', authPage)

        // If on auth page (login/signup) and logged in, redirect to main page
        if (authPage && session) {
          window.location.href = '/'
          return
        }
        
        // If on protected page and not logged in, redirect to login
        if (!authPage && !session) {
          window.location.href = '/login'
          return
        }
      } finally {
        setIsLoading(false)
      }

      console.log('checkAuth')
    }

    checkAuth()

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && authPage) {
        window.location.href = '/'
      } else if (event === 'SIGNED_OUT' && !authPage) {
        window.location.href = '/login'
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [authPage, router])

  return isLoading
} 