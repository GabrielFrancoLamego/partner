import { PartnerJoinForm } from "@/components/public/partner-join-form"

export default async function PartnerJoinPage({ searchParams }: { searchParams: Promise<{ ref?: string; token?: string }> }) {
  const { ref, token } = await searchParams
  return <PartnerJoinForm refCode={ref ?? null} linkToken={token ?? null} />
}
