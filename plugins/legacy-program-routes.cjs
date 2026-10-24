// JSX filename routes encode '+' and spaces into literal output directories.
// Register the original decoded route explicitly so static servers find it.
module.exports = function legacyProgramRoutes({baseUrl}) {
  return {
    name: 'legacy-program-routes',
    contentLoaded({actions}) {
      actions.addRoute({
        path: `${baseUrl}B+/UCLA MENG`,
        component: '@site/src/components/LegacyUclaMeng.jsx',
        exact: true,
      });
    },
  };
};
