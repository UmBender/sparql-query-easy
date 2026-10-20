<!--
	STUDY-005: the final submission, behind a confirmation dialog. Afterwards
	every study query is refetched and answers `forbidden`, so the pages show
	the finished view.
-->
<script lang="ts">
	import { useQueryClient } from '@tanstack/svelte-query';
	import { toast } from 'svelte-sonner';
	import { api } from '#lib/api/client.js';
	import { queryKeys } from '#lib/api/queries.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import * as Dialog from '#lib/components/ui/dialog/index.js';

	const queryClient = useQueryClient();
	let open = $state(false);
	let pending = $state(false);

	async function finish() {
		pending = true;
		try {
			await api.study.finish();
			open = false;
			await queryClient.invalidateQueries({ queryKey: queryKeys.study });
		} catch (error) {
			toast.error(error instanceof Error ? error.message : String(error));
		} finally {
			pending = false;
		}
	}
</script>

<Button variant="destructive" onclick={() => (open = true)}>Finish the study</Button>
<Dialog.Root bind:open>
	<Dialog.Content class="max-w-md">
		<Dialog.Header>
			<Dialog.Title>Finish the study?</Dialog.Title>
			<Dialog.Description>
				This is your final submission. Afterwards you can no longer open or answer the
				proposed queries.
			</Dialog.Description>
		</Dialog.Header>
		<Dialog.Footer>
			<Button variant="outline" onclick={() => (open = false)}>Keep working</Button>
			<Button variant="destructive" disabled={pending} onclick={finish}
				>Finish and submit</Button
			>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
