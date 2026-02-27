'use client'

import { ReactNode } from 'react'
import { UnlinkProvider as Provider } from '@unlink-xyz/react'

export function UnlinkWrapper({ children }: { children: ReactNode }) {
  return (
    <Provider chain="monad-testnet" autoSync={true} syncInterval={5000}>
      {children}
    </Provider>
  )
}
