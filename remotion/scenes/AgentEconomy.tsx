import React from 'react';
import {
	AbsoluteFill,
	useCurrentFrame,
	interpolate,
	spring,
	useVideoConfig,
} from 'remotion';
import {colors, fonts} from '../styles';

const stats = [
	{label: 'PER EDITION', value: 0.05, prefix: '$', suffix: ' USDC', decimals: 2},
	{label: 'TO AGENTS', value: 80, prefix: '', suffix: '%', decimals: 0},
	{label: 'TO TREASURY', value: 20, prefix: '', suffix: '%', decimals: 0},
];

export const AgentEconomy: React.FC = () => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();

	const titleProgress = spring({
		frame,
		fps,
		config: {damping: 15, stiffness: 100},
	});

	return (
		<AbsoluteFill
			style={{
				backgroundColor: colors.dark,
				justifyContent: 'center',
				alignItems: 'center',
				flexDirection: 'column',
			}}
		>
			{/* Dot grid pattern */}
			<div
				style={{
					position: 'absolute',
					inset: 0,
					backgroundImage: `radial-gradient(${colors.muted}20 1px, transparent 1px)`,
					backgroundSize: '30px 30px',
				}}
			/>

			{/* Title */}
			<div
				style={{
					opacity: titleProgress,
					transform: `translateY(${interpolate(titleProgress, [0, 1], [20, 0])}px)`,
					marginBottom: 70,
					position: 'relative',
					zIndex: 1,
				}}
			>
				<span
					style={{
						fontFamily: fonts.mono,
						fontSize: 18,
						color: colors.orange,
						letterSpacing: '0.3em',
						textTransform: 'uppercase',
					}}
				>
					The Agent Economy
				</span>
			</div>

			{/* Stats */}
			<div
				style={{
					display: 'flex',
					gap: 100,
					justifyContent: 'center',
					position: 'relative',
					zIndex: 1,
				}}
			>
				{stats.map((stat, i) => {
					const delay = 20 + i * 30;
					const progress = spring({
						frame: frame - delay,
						fps,
						config: {damping: 12, stiffness: 80},
					});

					const currentNum = interpolate(
						frame,
						[delay, delay + 40],
						[0, stat.value],
						{extrapolateRight: 'clamp', extrapolateLeft: 'clamp'},
					);

					const displayValue = `${stat.prefix}${currentNum.toFixed(stat.decimals)}`;

					return (
						<div
							key={stat.label}
							style={{
								textAlign: 'center',
								opacity: progress,
								transform: `scale(${interpolate(progress, [0, 1], [0.8, 1])})`,
							}}
						>
							<div
								style={{
									fontFamily: fonts.serif,
									fontSize: 100,
									color: colors.orange,
									fontWeight: 700,
									lineHeight: 1,
								}}
							>
								{displayValue}
								<span style={{fontSize: 48}}>{stat.suffix}</span>
							</div>
							<div
								style={{
									fontFamily: fonts.mono,
									fontSize: 14,
									color: colors.muted,
									letterSpacing: '0.2em',
									marginTop: 20,
								}}
							>
								{stat.label}
							</div>
						</div>
					);
				})}
			</div>

			{/* x402 label */}
			<div
				style={{
					position: 'absolute',
					bottom: 60,
					opacity: interpolate(frame, [100, 120], [0, 1], {
						extrapolateRight: 'clamp',
						extrapolateLeft: 'clamp',
					}),
					zIndex: 1,
				}}
			>
				<span
					style={{
						fontFamily: fonts.mono,
						fontSize: 14,
						color: colors.muted,
						letterSpacing: '0.2em',
					}}
				>
					POWERED BY X402 MICROPAYMENTS
				</span>
			</div>
		</AbsoluteFill>
	);
};
