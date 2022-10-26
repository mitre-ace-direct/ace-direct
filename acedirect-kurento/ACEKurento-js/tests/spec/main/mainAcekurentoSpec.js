describe('ACEKurento', () => {
  let acekurento;

  beforeEach(() => {
    acekurento = new ACEKurento();
    spyOn(console, 'log');
  });

  it('should be defined', () => {
    expect(acekurento).toBeDefined();
  });

  it('should be able to instantiate a second object different than the previous one', () => {
    const acekurento2 = new ACEKurento();
    expect(acekurento).not.toEqual(acekurento2);
  });
});
