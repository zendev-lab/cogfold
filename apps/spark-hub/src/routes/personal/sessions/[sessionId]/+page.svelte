<script lang="ts">
  import { enhance } from "$app/forms";
  import { invalidateAll } from "$app/navigation";
  import { Button, PageHeader } from "@zendev-lab/spark-ui";
  import { SafeMarkdown } from "@zendev-lab/spark-ui/markdown";
  let { data, form } = $props();
  const t = $derived(data.messages.personal);
</script>
<svelte:head><title>{t.conversations} · Ulota</title></svelte:head>
<PageHeader title={t.conversations} />
<Button variant="secondary" onclick={() => void invalidateAll()}>{t.refresh}</Button>
{#if !data.snapshot}<p role="status">{t.unavailable}</p>{:else}
  {#if data.snapshot.snapshot.messages.length === 0}<p>{t.emptyChat}</p>{/if}
  <ol class="messages">{#each data.snapshot.snapshot.messages.filter(message => message.display !== false) as message (message.id)}<li><strong>{message.role}</strong><SafeMarkdown source={message.text} /></li>{/each}</ol>
  <form method="POST" use:enhance><label>{t.message}<textarea name="prompt" rows="4" required maxlength="32000"></textarea></label><input type="hidden" name="submissionId" value={data.submissionId} /><Button type="submit">{t.send}</Button></form>
{/if}
{#if form?.failed}<p role="alert">{t.failure}</p>{/if}
<style>.messages { list-style: none; padding: 0; max-width: 72ch; } label { flex: 1; } textarea { width: 100%; }</style>
