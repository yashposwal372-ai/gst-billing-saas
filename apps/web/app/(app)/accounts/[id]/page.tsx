import { FinancePage } from "../../../../components/finance/finance-page";
export default async function Page({ params }: { params: Promise<{ id: string }> }) { return <FinancePage mode="account-detail" id={(await params).id} />; }
