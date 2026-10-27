import optimizeSb3 from '../../src/packager/minify/sb3';

const clone = (obj) => JSON.parse(JSON.stringify(obj));

const emptyTarget = () => ({
  name: '',
  blocks: {},
  comments: {},
  variables: {},
  lists: {},
  tables: {},
  broadcasts: {},
});

test('does not throw if project does not have monitors', () => {
  const data = {
    targets: [],
    meta: {}
  };
  optimizeSb3(clone(data));
});

test('preserves comments', () => {
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
      text: "wregoiujji"
    },
    {
      text: " // _gamepad_"
    }
  ]);
});
