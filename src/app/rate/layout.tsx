import { redirect } from 'next/navigation'

export default function RateLayout({ children }: { children: React.ReactNode }) {
  if (process.env.NEXT_PUBLIC_APP_MODE !== 'DEV') {
    redirect('/')
  }
  return <>{children}</>
}
