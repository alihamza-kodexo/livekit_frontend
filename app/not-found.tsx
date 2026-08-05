import { ButtonLink, EmptyState, PageHeader } from "@/components/ui";

export default function NotFound() {
  return (
    <>
      <PageHeader title="Not found" />
      <EmptyState
        title="That page doesn't exist"
        description="The agent, number or call you're looking for may have been deleted."
        action={<ButtonLink href="/agents">Back to agents</ButtonLink>}
      />
    </>
  );
}
