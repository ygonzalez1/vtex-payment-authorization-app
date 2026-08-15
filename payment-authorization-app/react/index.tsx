import React, { Component } from 'react'
import styles from './index.css'

declare global {
  interface Window {
    $: (selector: any) => any
  }
}

type Props = {
  appPayload: string
}

type ThreeDsPayload = {
  url3DSRef?: string
}

type State = {
  url3DSRef: string | null
  errorMessage: string | null
}

/** Integrator hosts that serve /3ds/return and postMessage the closure event. */
const ALLOWED_ORIGINS = new Set([
  'https://vtex.paguelofacil.com',
  'https://vtex.pfserver.net',
  'http://localhost:8088',
  'http://127.0.0.1:8088',
])

const parsePayload = (appPayload: string): ThreeDsPayload | null => {
  try {
    return JSON.parse(appPayload) as ThreeDsPayload
  } catch {
    return null
  }
}

const originOf = (url: string): string | null => {
  try {
    return new URL(url).origin
  } catch {
    return null
  }
}

const isAllowedOrigin = (origin: string, url3DSRef: string | null): boolean => {
  if (ALLOWED_ORIGINS.has(origin)) {
    return true
  }
  // Mock simulator and return share the same integrator host as url3DSRef.
  const challengeOrigin = url3DSRef ? originOf(url3DSRef) : null
  return challengeOrigin !== null && challengeOrigin === origin
}

class PaguelofacilThreeDsApp extends Component<Props, State> {
  private messageFired = false
  private messageHandler: ((e: MessageEvent) => void) | null = null

  constructor(props: Props) {
    super(props)
    this.state = {
      url3DSRef: null,
      errorMessage: null,
    }
  }

  componentDidMount() {
    window.$(window).trigger('removePaymentLoading.vtex')

    const payload = parsePayload(this.props.appPayload)
    if (!payload) {
      this.setState({ errorMessage: 'Invalid payment payload.' })
      return
    }

    const url3DSRef = payload.url3DSRef?.trim()
    if (!url3DSRef) {
      this.setState({ errorMessage: 'Missing 3DS challenge URL.' })
      return
    }

    this.setState({ url3DSRef })

    this.messageHandler = (e: MessageEvent) => {
      if (this.messageFired) {
        return
      }
      if (!e.data || e.data.type !== 'transactionValidation.vtex') {
        return
      }
      // Use url3DSRef from closure -- setState is async and may not have flushed yet.
      if (!isAllowedOrigin(e.origin, url3DSRef)) {
        console.warn(
          '3DS Payment App: ignored transactionValidation.vtex from unexpected origin',
          e.origin
        )
        return
      }

      this.messageFired = true
      // approved: true -> Order Placed; false -> reject and return to payment selection.
      // Legacy field "dispatch" kept for older return HTML (true/absent = approved).
      const approved =
        typeof e.data.approved === 'boolean'
          ? e.data.approved
          : e.data.dispatch !== false

      console.log('3DS Payment App: relaying transactionValidation.vtex, approved=', approved)
      window.$(window).trigger('transactionValidation.vtex', [approved])
    }

    window.addEventListener('message', this.messageHandler)
  }

  componentWillUnmount() {
    if (this.messageHandler) {
      window.removeEventListener('message', this.messageHandler)
      this.messageHandler = null
    }
  }

  render() {
    const { url3DSRef, errorMessage } = this.state

    if (errorMessage) {
      return (
        <div className={styles.wrapper}>
          <p className={styles.error}>{errorMessage}</p>
        </div>
      )
    }

    if (!url3DSRef) {
      return (
        <div className={styles.wrapper}>
          <p className={styles.loading}>Loading authentication...</p>
        </div>
      )
    }

    return (
      <div className={styles.wrapper}>
        <iframe
          className={styles.iframe}
          src={url3DSRef}
          title="3D Secure authentication"
          allow="payment"
        />
      </div>
    )
  }
}

export default PaguelofacilThreeDsApp
