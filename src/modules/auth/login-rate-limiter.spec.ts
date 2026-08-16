import { HttpException, HttpStatus } from '@nestjs/common';
import { LoginRateLimiter } from './login-rate-limiter';

describe('LoginRateLimiter', () => {
  let limiter: LoginRateLimiter;

  beforeEach(() => {
    limiter = new LoginRateLimiter(3, 60000, 60000); // 3 attempts max
  });

  it('allows attempts under the threshold', () => {
    expect(() => limiter.check('test@gxa.local')).not.toThrow();
    limiter.recordFailure('test@gxa.local');
    expect(() => limiter.check('test@gxa.local')).not.toThrow();
    limiter.recordFailure('test@gxa.local');
    expect(() => limiter.check('test@gxa.local')).not.toThrow();
  });

  it('blocks attempts after reaching max attempts', () => {
    limiter.recordFailure('attacker@gxa.local');
    limiter.recordFailure('attacker@gxa.local');
    limiter.recordFailure('attacker@gxa.local');

    expect(() => limiter.check('attacker@gxa.local')).toThrow(HttpException);
    try {
      limiter.check('attacker@gxa.local');
    } catch (err) {
      expect((err as HttpException).getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
    }
  });

  it('resets attempts on successful authentication', () => {
    limiter.recordFailure('user@gxa.local');
    limiter.recordFailure('user@gxa.local');
    limiter.reset('user@gxa.local');

    limiter.recordFailure('user@gxa.local');
    expect(() => limiter.check('user@gxa.local')).not.toThrow();
  });
});
