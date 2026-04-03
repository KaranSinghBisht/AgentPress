import React from 'react';
import {AbsoluteFill, useCurrentFrame, interpolate} from 'remotion';
import {colors, fonts} from '../styles';

const lines = [
	{text: '$ agentpress connect --mcp', delay: 5, color: colors.white},
	{text: '> connected to AgentPress MCP server', delay: 18, color: colors.green},
	{text: '> x402 payment channel: active', delay: 30, color: colors.green},
	{text: '> submitting intelligence signal...', delay: 42, color: colors.green},
	{text: '✓ signal accepted. edition queued.', delay: 58, color: colors.orange},
];

export const TerminalView: React.FC = () => {
	const frame = useCurrentFrame();

	const windowOpacity = interpolate(frame, [0, 10], [0, 1], {
		extrapolateRight: 'clamp',
	});
	const windowScale = interpolate(frame, [0, 10], [0.95, 1], {
		extrapolateRight: 'clamp',
	});

	return (
		<AbsoluteFill
			style={{
				backgroundColor: colors.black,
				justifyContent: 'center',
				alignItems: 'center',
			}}
		>
			<div
				style={{
					width: 920,
					backgroundColor: colors.dark,
					borderRadius: 12,
					border: `1px solid ${colors.muted}40`,
					overflow: 'hidden',
					opacity: windowOpacity,
					transform: `scale(${windowScale})`,
					boxShadow: `0 0 80px ${colors.green}15`,
				}}
			>
				{/* Window chrome */}
				<div
					style={{
						padding: '14px 18px',
						display: 'flex',
						gap: 8,
						alignItems: 'center',
						backgroundColor: `${colors.muted}15`,
						borderBottom: `1px solid ${colors.muted}20`,
					}}
				>
					{['#FF5F57', '#FEBC2E', '#28C840'].map((c) => (
						<div
							key={c}
							style={{
								width: 12,
								height: 12,
								borderRadius: '50%',
								backgroundColor: c,
							}}
						/>
					))}
					<span
						style={{
							fontFamily: fonts.mono,
							fontSize: 13,
							color: colors.muted,
							marginLeft: 12,
						}}
					>
						agentpress-mcp
					</span>
				</div>

				{/* Terminal content */}
				<div style={{padding: 36}}>
					{lines.map((line) => {
						const charCount = line.text.length;
						const typedChars = Math.floor(
							interpolate(
								frame,
								[line.delay, line.delay + charCount * 0.35],
								[0, charCount],
								{extrapolateRight: 'clamp', extrapolateLeft: 'clamp'},
							),
						);

						if (frame < line.delay) return null;

						return (
							<div
								key={line.text}
								style={{
									fontFamily: fonts.mono,
									fontSize: 18,
									color: line.color,
									lineHeight: 2.2,
								}}
							>
								{line.text.slice(0, typedChars)}
								{typedChars < charCount && typedChars > 0 && (
									<span
										style={{
											display: 'inline-block',
											width: 10,
											height: 20,
											backgroundColor: line.color,
											marginLeft: 2,
											verticalAlign: 'middle',
											opacity: frame % 15 < 8 ? 1 : 0,
										}}
									/>
								)}
							</div>
						);
					})}
				</div>
			</div>
		</AbsoluteFill>
	);
};
