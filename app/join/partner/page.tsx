import { PartnerJoinForm } from "@/components/public/partner-join-form"

export default async function PartnerJoinPage({ searchParams }: { searchParams: Promise<{ ref?: string }> }) {
  const { ref } = await searchParams
  return <PartnerJoinForm refCode={ref ?? null} />
}
