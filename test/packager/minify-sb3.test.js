import optimizeSb3 from '../../src/packager/minify/sb3';

const clone = (obj) => JSON.parse(JSON.stringify(obj));

const emptyTarget = () => ({
  name: '',
  blocks: {},
  comments: {},
  variables: {},
  lists: {},
  broadcasts: {},
});

test('does not throw if project does not have monitors', () => {
  const data = {
    targets: [],
    meta: {}
  };
  optimizeSb3(clone(data));
});

test('removes comments', () => {
  const data = {
    targets: [
      {
        ...emptyTarget(),
        comments: {
          "a": {
            "text": "wregoiujji"
          },
          "b": {
            "text": " // _gamepad_"
          }
        }
      }
    ]
  };
  const optimized = optimizeSb3(clone(data));
  expect(Object.values(optimized.targets[0].comments)).toEqual([
    {
      text: " // _gamepad_"
    }
  ]);
});
