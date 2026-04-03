import React from 'react';
import {
	AbsoluteFill,
	useCurrentFrame,
	interpolate,
	spring,
	useVideoConfig,
} from 'remotion';
import {colors, fonts} from '../styles';

export const OWSShowcase: React.FC = () => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();

	const titleProgress = spring({
		frame,
		fps,
		config: {damping: 15, stiffness: 100},
	});

	const cardProgress = spring({
		frame: frame - 15,
		fps,
		config: {damping: 12, stiffness: 80},
	});

	const sigProgress = spring({
		frame: frame - 40,
		fps,
		config: {damping: 12, stiffness: 80},
	});

	const checkProgress = spring({
		frame: frame - 70,
		fps,
		config: {damping: 10, stiffness: 120},
	});

	return (
		<AbsoluteFill
			style={{
				backgroundColor: colors.black,
				justifyContent: 'center',
				alignItems: 'center',
				flexDirection: 'column',
			}}
		>
			{/* Title */}
			<div
				style={{
					opacity: titleProgress,
					transform: `translateY(${interpolate(titleProgress, [0, 1], [20, 0])}px)`,
					marginBottom: 50,
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
					Powered by OWS Protocol
				</span>
			</div>

			{/* Wallet card */}
			<div
				style={{
					width: 700,
					backgroundColor: '#1A1A1A',
					border: `2px solid ${colors.border}`,
					borderRadius: 12,
					padding: 40,
					opacity: cardProgress,
					transform: `scale(${interpolate(cardProgress, [0, 1], [0.95, 1])})`,
				}}
			>
				{/* Wallet header */}
				<div
					style={{
						display: 'flex',
						justifyContent: 'space-between',
						alignItems: 'center',
						marginBottom: 28,
					}}
				>
					<span
						style={{
							fontFamily: fonts.mono,
							fontSize: 14,
							color: colors.muted,
							letterSpacing: '0.15em',
						}}
					>
						OWS AGENT WALLET
					</span>
					<div
						style={{
							width: 10,
							height: 10,
							borderRadius: '50%',
							backgroundColor: colors.green,
							boxShadow: `0 0 8px ${colors.green}80`,
						}}
					/>
				</div>

				{/* Address */}
				<div style={{marginBottom: 24}}>
					<span
						style={{
							fontFamily: fonts.mono,
							fontSize: 13,
							color: colors.muted,
							display: 'block',
							marginBottom: 6,
						}}
					>
						CAIP-10 Identity
					</span>
					<span
						style={{
							fontFamily: fonts.mono,
							fontSize: 22,
							color: colors.white,
						}}
					>
						eip155:8453:0xA7f3...c9E2
					</span>
				</div>

				{/* Signature */}
				<div
					style={{
						opacity: sigProgress,
						borderTop: `1px solid ${colors.border}`,
						paddingTop: 20,
					}}
				>
					<span
						style={{
							fontFamily: fonts.mono,
							fontSize: 13,
							color: colors.muted,
							display: 'block',
							marginBottom: 6,
						}}
					>
						Signal Signature
					</span>
					<span
						style={{
							fontFamily: fonts.mono,
							fontSize: 16,
							color: colors.orange,
							wordBreak: 'break-all',
						}}
					>
						0x8b4e2f...d91a3c7b
					</span>
				</div>

				{/* Verification badge */}
				<div
					style={{
						marginTop: 24,
						display: 'flex',
						alignItems: 'center',
						gap: 10,
						opacity: checkProgress,
						transform: `translateX(${interpolate(checkProgress, [0, 1], [-10, 0])}px)`,
					}}
				>
					<div
						style={{
							width: 28,
							height: 28,
							borderRadius: '50%',
							backgroundColor: colors.green,
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'center',
						}}
					>
						<span style={{fontSize: 16, color: colors.black, fontWeight: 700}}>
							✓
						</span>
					</div>
					<span
						style={{
							fontFamily: fonts.mono,
							fontSize: 15,
							color: colors.green,
							letterSpacing: '0.05em',
						}}
					>
						Cryptographically verified — every submission signed
					</span>
				</div>
			</div>
		</AbsoluteFill>
	);
};
