<!--
	A square button that shows only an icon. `label` is its accessible name and
	its tooltip; there is no icon button without one.
-->
<script lang="ts">
	import { Button, type ButtonProps } from '#lib/components/ui/button/index.js';
	import * as Tooltip from '#lib/components/ui/tooltip/index.js';

	let {
		label,
		variant = 'ghost',
		size = 'icon',
		children,
		...restProps
	}: ButtonProps & { label: string } = $props();
</script>

<Tooltip.Root>
	<Tooltip.Trigger>
		{#snippet child({ props })}
			<Button {...props} {...restProps} {variant} {size} aria-label={label}>
				{@render children?.()}
			</Button>
		{/snippet}
	</Tooltip.Trigger>
	<Tooltip.Content>{label}</Tooltip.Content>
</Tooltip.Root>
