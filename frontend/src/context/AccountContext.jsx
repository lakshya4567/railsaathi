import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { getAccountProfile } from '../services/api'

const AccountContext = createContext(null)
const GOOGLE_CLIENT_ID = (import.meta.env.VITE_GOOGLE_CLIENT_ID || '').trim()
const ACCOUNT_KEY = 'railsaathi_google_account_v1'

function readCachedAccount() {
  try { return JSON.parse(localStorage.getItem(ACCOUNT_KEY) || 'null') } catch { return null }
}

export function AccountProvider({ children }) {
  const [account, setAccount] = useState(readCachedAccount)
  const [googleCredential, setGoogleCredential] = useState(null)
  const [accountError, setAccountError] = useState('')

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return undefined
    let cancelled = false
    const onCredential = async (response) => {
      if (!response?.credential) return
      setAccountError('')
      try {
        const profile = await getAccountProfile(response.credential)
        if (cancelled) return
        setGoogleCredential(response.credential)
        setAccount(profile.user)
        try { localStorage.setItem(ACCOUNT_KEY, JSON.stringify(profile.user)) } catch {}
      } catch (error) {
        if (!cancelled) {
          setGoogleCredential(null)
          setAccountError(error.message || 'Could not load your RailSaathi account.')
        }
      }
    }
    window.__railsaathiGoogleCredentialHandler = onCredential
    const initialize = () => {
      if (cancelled || !window.google?.accounts?.id) return
      if (!window.__railsaathiGoogleInitialized) {
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          auto_select: true,
          callback: (response) => window.__railsaathiGoogleCredentialHandler?.(response),
        })
        window.__railsaathiGoogleInitialized = true
      }
      window.google.accounts.id.prompt()
    }
    if (window.google?.accounts?.id) initialize()
    else {
      let script = document.querySelector('script[data-railsaathi-google-identity]')
      if (!script) {
        script = document.createElement('script')
        script.src = 'https://accounts.google.com/gsi/client'
        script.async = true
        script.defer = true
        script.dataset.railsaathiGoogleIdentity = 'true'
        document.head.appendChild(script)
      }
      script.addEventListener('load', initialize)
    }
    return () => { cancelled = true }
  }, [])

  const promptSignIn = () => {
    if (window.google?.accounts?.id) window.google.accounts.id.prompt()
    else setAccountError('Google sign-in is still loading. Please try again in a moment.')
  }
  const signOut = () => {
    window.google?.accounts?.id?.disableAutoSelect()
    setGoogleCredential(null)
    setAccount(null)
    setAccountError('')
    try { localStorage.removeItem(ACCOUNT_KEY) } catch {}
  }

  const value = useMemo(() => ({ account, googleCredential, accountError, promptSignIn, signOut }), [account, googleCredential, accountError])
  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>
}

export function useRailSaathiAccount() {
  const value = useContext(AccountContext)
  if (!value) throw new Error('useRailSaathiAccount must be used inside AccountProvider')
  return value
}
