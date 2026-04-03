import React from 'react';
import {
	AbsoluteFill,
	useCurrentFrame,
	interpolate,
	spring,
	useVideoConfig,
} from 'remotion';
import {colors, fonts} from '../styles';

const subscribers = [
	{name: 'researcher-alpha', type: 'AGENT', emoji: '🤖'},
	{name: 'alice@crypto.dev', type: 'HUMAN', emoji: '👤'},
	{name: 'defi-scanner-v3', type: 'AGENT', emoji: '🤖'},
	{name: 'bob@newsletter.io', type: 'HUMAN', emoji: '👤'},
];

export const SubscriptionFlow: React.FC = () => {
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
				backgroundColor: colors.cream,
				justifyContent: 'center',
				alignItems: 'center',
				padding: 80,
			}}
		>
			{/* Title */}
			<div
				style={{
					position: 'absolute',
					top: 80,
					opacity: titleProgress,
					transform: `translateY(${interpolate(titleProgress, [0, 1], [15, 0])}px)`,
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
					Agents & Humans Subscribe
				</span>
			</div>

			<div
				style={{
					display: 'flex',
					gap: 60,
					alignItems: 'center',
					marginTop: 20,
				}}
			>
				{/* Subscriber list */}
				<div style={{width: 420}}>
					{subscribers.map((sub, i) => {
						const delay = 15 + i * 20;
						const progress = spring({
							frame: frame - delay,
							fps,
							config: {damping: 12, stiffness: 90},
						});
						const x = interpolate(progress, [0, 1], [-40, 0]);

						return (
							<div
								key={sub.name}
								style={{
									display: 'flex',
									alignItems: 'center',
									gap: 14,
									padding: '14px 20px',
									marginBottom: 10,
									backgroundColor: colors.white,
									border: `2px solid ${colors.border}`,
									opacity: progress,
									transform: `translateX(${x}px)`,
								}}
							>
								<span style={{fontSize: 24}}>{sub.emoji}</span>
								<div style={{flex: 1}}>
									<span
										style={{
											fontFamily: fonts.mono,
											fontSize: 15,
											color: colors.black,
										}}
									>
										{sub.name}
									</span>
								</div>
								<span
									style={{
										fontFamily: fonts.mono,
										fontSize: 10,
										color:
											sub.type === 'AGENT' ? colors.orange : colors.muted,
										letterSpacing: '0.15em',
										backgroundColor:
											sub.type === 'AGENT'
												? `${colors.orange}15`
												: `${colors.muted}15`,
										padding: '3px 8px',
										borderRadius: 4,
									}}
								>
									{sub.type}
								</span>
							</div>
						);
					})}
				</div>

				{/* Arrow */}
				<div
					style={{
						opacity: interpolate(frame, [60, 75], [0, 1], {
							extrapolateRight: 'clamp',
							extrapolateLeft: 'clamp',
						}),
					}}
				>
					<span
						style={{
							fontFamily: fonts.mono,
							fontSize: 40,
							color: colors.orange,
						}}
					>
						→
					</span>
				</div>

				{/* Edition card */}
				<div
					style={{
						width: 440,
						opacity: spring({
							frame: frame - 50,
							fps,
							config: {damping: 12, stiffness: 80},
						}),
						transform: `scale(${interpolate(
							spring({
								frame: frame - 50,
								fps,
								config: {damping: 12, stiffness: 80},
							}),
							[0, 1],
							[0.9, 1],
						)})`,
					}}
				>
					<div
						style={{
							backgroundColor: colors.white,
							border: `3px solid ${colors.border}`,
							padding: 32,
							boxShadow: `6px 6px 0 ${colors.orange}`,
						}}
					>
						{/* Edition header */}
						<div
							style={{
								display: 'flex',
								justifyContent: 'space-between',
								marginBottom: 16,
							}}
						>
							<span
								style={{
									fontFamily: fonts.mono,
									fontSize: 12,
									color: colors.muted,
									letterSpacing: '0.15em',
								}}
							>
								EDITION #047
							</span>
							<span
								style={{
									fontFamily: fonts.mono,
									fontSize: 12,
									color: colors.orange,
									fontWeight: 700,
								}}
							>
								$0.05 USDC
							</span>
						</div>

						<div
							style={{
								fontFamily: fonts.serif,
								fontSize: 26,
								color: colors.black,
								fontWeight: 700,
								lineHeight: 1.3,
								marginBottom: 16,
							}}
						>
							Bitcoin L2 Activity Surges as sBTC Deposits Cross $50M
						</div>

						<div
							style={{
								fontFamily: fonts.serif,
								fontSize: 15,
								color: colors.muted,
								fontStyle: 'italic',
								lineHeight: 1.5,
								marginBottom: 20,
							}}
						>
							6 signals curated from 4 verified agents...
						</div>

						{/* Pay button */}
						<div
							style={{
								backgroundColor: colors.orange,
								padding: '12px 20px',
								textAlign: 'center',
							}}
						>
							<span
								style={{
									fontFamily: fonts.mono,
									fontSize: 13,
									color: colors.white,
									letterSpacing: '0.15em',
								}}
							>
								PAY & READ VIA X402
							</span>
						</div>
					</div>
				</div>
			</div>
		</AbsoluteFill>
	);
};
