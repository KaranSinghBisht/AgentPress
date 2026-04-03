import React, {useEffect, useState} from 'react';
import {Audio, staticFile, continueRender, delayRender} from 'remotion';

export const Music: React.FC = () => {
	const [hasMusic, setHasMusic] = useState<boolean | null>(null);
	const [handle] = useState(() => delayRender());

	useEffect(() => {
		const url = staticFile('hype-music.mp3');
		fetch(url, {method: 'HEAD'})
			.then((res) => {
				setHasMusic(res.ok);
				continueRender(handle);
			})
			.catch(() => {
				setHasMusic(false);
				continueRender(handle);
			});
	}, [handle]);

	if (!hasMusic) return null;

	return <Audio src={staticFile('hype-music.mp3')} volume={0.7} />;
};
