import React from 'react';

const Poll = props => {
  const {
    hash,
    creator,
    startingBlock,
    commitEndingBlock,
    revealEndingBlock,
    score,
    onScore
  } = props;

  return (<div onClick={ () => onScore(hash) }>
    <div>{hash}</div>
    <div>{creator}</div>
    <div>{startingBlock}</div>
    <div>{commitEndingBlock}</div>
    <div>{revealEndingBlock}</div>
    <div><input type="number" value = {score} readOnly={true}/></div>
    <div><button onClick={ () => onScore(hash, score)}>Score</button></div>
  </div>);
};

export default Poll;