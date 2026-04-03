import React from 'react';
import {
	AbsoluteFill,
	useCurrentFrame,
	spring,
	useVideoConfig,
	interpolate,
} from 'remotion';
import {colors, fonts} from '../styles';

const steps = [
	{
		num: '01',
		title: 'Agents Submit',
		desc: 'Intelligence signals signed with OWS wallets',
		tag: 'OWS PROTOCOL',
	},
	{
		num: '02',
		title: 'Editor Curates',
		desc: 'Autonomous 8-factor scoring algorithm',
		tag: 'AI POWERED',
	},
	{
		num: '03',
		title: 'Readers Pay',
		desc: '$0.05 USDC per edition via x402',
		tag: 'X402 PAYMENTS',
	},
];

export const MachineProcess: React.FC = () => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();

	const titleOpacity = interpolate(frame, [0, 20], [0, 1], {
		extrapolateRight: 'clamp',
	});
	const titleY = interpolate(frame, [0, 20], [30, 0], {
		extrapolateRight: 'clamp',
	});

	return (
		<AbsoluteFill
			style={{
				backgroundColor: colors.cream,
				padding: '80px 80px 60px',
				flexDirection: 'column',
			}}
		>
			{/* Section title */}
			<div
				style={{
					opacity: titleOpacity,
					transform: `translateY(${titleY}px)`,
					marginBottom: 50,
					textAlign: 'center',
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
					The Machine Process
				</span>
			</div>

			{/* Cards */}
			<div
				style={{
					display: 'flex',
					gap: 36,
					justifyContent: 'center',
					alignItems: 'stretch',
					flex: 1,
				}}
			>
				{steps.map((step, i) => {
					const delay = 25 + i * 50;
					const progress = spring({
						frame: frame - delay,
						fps,
						config: {damping: 12, stiffness: 80},
					});
					const y = interpolate(progress, [0, 1], [80, 0]);

					return (
						<div
							key={step.num}
							style={{
								flex: 1,
								backgroundColor: colors.white,
								border: `3px solid ${colors.border}`,
								padding: '40px 36px',
								opacity: progress,
								transform: `translateY(${y}px)`,
								display: 'flex',
								flexDirection: 'column',
								justifyContent: 'center',
								alignItems: 'center',
								textAlign: 'center',
								position: 'relative',
							}}
						>
							{/* Tag */}
							<div
								style={{
									position: 'absolute',
									top: 16,
									right: 16,
									backgroundColor: i === 0 ? colors.orange : `${colors.border}15`,
									padding: '4px 10px',
									borderRadius: 4,
								}}
							>
								<span
									style={{
										fontFamily: fonts.mono,
										fontSize: 10,
										color: i === 0 ? colors.white : colors.muted,
										letterSpacing: '0.15em',
									}}
								>
									{step.tag}
								</span>
							</div>

							<span
								style={{
									fontFamily: fonts.serif,
									fontSize: 76,
									color: colors.orange,
									fontStyle: 'italic',
									fontWeight: 300,
									lineHeight: 1,
									marginBottom: 20,
								}}
							>
								{step.num}
							</span>
							<span
								style={{
									fontFamily: fonts.serif,
									fontSize: 34,
									color: colors.black,
									fontWeight: 700,
									marginBottom: 14,
								}}
							>
								{step.title}
							</span>
							<span
								style={{
									fontFamily: fonts.serif,
									fontSize: 19,
									color: colors.muted,
									fontStyle: 'italic',
									lineHeight: 1.5,
								}}
							>
								&ldquo;{step.desc}&rdquo;
							</span>
						</div>
					);
				})}
			</div>
		</AbsoluteFill>
	);
};
