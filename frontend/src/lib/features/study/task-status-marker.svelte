<!--
	The participant's own progress on a task in the task list (STUDY-014,
	DEC-020 C8): not started or answered, with the time of the last save;
	never correctness. An icon and a word, never colour alone. Inside a hovered or focused task
	link it takes the link's accent colours so the text keeps its contrast.
-->
<script lang="ts">
	import CircleDashedIcon from '@lucide/svelte/icons/circle-dashed';
	import CircleDotIcon from '@lucide/svelte/icons/circle-dot';
	import type { StudyTaskSummary } from '#lib/api/client.js';
	import { savedAtLabel } from '#lib/domain/study.js';
	import { cn } from '#lib/utils.js';

	let {
		status,
		lastSavedAt = null
	}: { status: StudyTaskSummary['status']; lastSavedAt?: string | null } = $props();

	const markers = {
		not_started: {
			label: 'Not started',
			icon: CircleDashedIcon,
			tone: 'text-muted-foreground'
		},
		answered: { label: 'Answered', icon: CircleDotIcon, tone: 'text-primary' }
	} as const;
	const marker = $derived(markers[status]);
</script>

<span
	class={cn(
		'inline-flex shrink-0 items-center gap-1 text-xs font-medium group-hover:text-accent-foreground group-focus-visible:text-accent-foreground',
		marker.tone
	)}
	data-testid="study-task-status"
	data-status={status}
>
	<marker.icon class="size-4" aria-hidden="true" />
	<span
		>{marker.label}{#if lastSavedAt}<span class="font-normal"
				>, saved <time datetime={lastSavedAt}>{savedAtLabel(lastSavedAt)}</time></span
			>{/if}</span
	>
</span>
