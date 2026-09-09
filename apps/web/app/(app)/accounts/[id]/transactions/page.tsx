import { AccountLedger } from "../../../../../components/finance/finance-page";
export default async function Page({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <AccountLedger id={id} />; }
