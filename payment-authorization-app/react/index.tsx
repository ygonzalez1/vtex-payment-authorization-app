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

const ALLOWED_ORIGIN = 'https://vtex.paguelofacil.com'

const parsePayload = (appPayload: string): ThreeDsPayload | null => {
  try {
    return JSON.parse(appPayload) as ThreeDsPayload
  } catch {
    return null
  }
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
      if (this.messageFired) return
      if (e.origin !== ALLOWED_ORIGIN) return
      if (!e.data || e.data.type !== 'transactionValidation.vtex') return

      this.messageFired = true
      // dispatch: false means fail-closed (validation failed on middle); true or absent means proceed
      const status = e.data.dispatch !== false
      window.$(window).trigger('transactionValidation.vtex', [status])
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
