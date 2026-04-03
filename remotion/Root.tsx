import React from 'react';
import {Composition} from 'remotion';
import {HypeVideo} from './HypeVideo';

export const Root: React.FC = () => {
	return (
		<Composition
			id="AgentPressHype"
			component={HypeVideo}
			durationInFrames={900}
			fps={30}
			width={1920}
			height={1080}
		/>
	);
};
