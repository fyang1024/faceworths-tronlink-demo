import React from 'react';

const Poll = props => {
  const {
    hash,
    creator,
    faceHash,
    startingBlock,
    commitEndingBlock,
    revealEndingBlock,
    score,
    shorten,
    onCommit,
    onReveal
  } = props;

  return (<tr>
    <td>{shorten(hash)}</td>
    <td>{shorten(creator)}</td>
    <td>{shorten(faceHash)}</td>
    <td>{startingBlock}</td>
    <td>{commitEndingBlock}</td>
    <td>{revealEndingBlock}</td>
    <td><input type="number" value = {score} readOnly={true}/></td>
    <td>
      <button onClick={ () => onCommit(hash, score)}>Commit</button>
      <button onClick={ () => onReveal(hash, score)}>Reveal</button>
    </td>
  </tr>);
};

export default Poll;