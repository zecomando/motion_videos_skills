import {Composition} from "remotion";
import example from "../timeline.example.json";
import {TalkingHead} from "./TalkingHead";
import {type Timeline, validateTimeline} from "./types";

export const Root = () => (
  <Composition
    id="TalkingHead"
    component={TalkingHead}
    defaultProps={example as Timeline}
    width={720}
    height={1280}
    fps={30}
    durationInFrames={480}
    calculateMetadata={({props}) => {
      const data = validateTimeline(props);
      return {
        width: data.width,
        height: data.height,
        fps: data.fps,
        durationInFrames: data.durationInFrames,
      };
    }}
  />
);
