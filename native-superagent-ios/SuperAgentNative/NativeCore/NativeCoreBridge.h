#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

@interface NativeCoreBridge : NSObject

+ (NSDictionary<NSString *, id> *)runNBodyWithBodies:(NSInteger)bodies
                                               steps:(NSInteger)steps
                                                seed:(uint64_t)seed
  NS_SWIFT_NAME(runNBody(bodies:steps:seed:));

+ (NSDictionary<NSString *, id> *)runGridPathWithWidth:(NSInteger)width
                                                 height:(NSInteger)height
                                           obstacleRate:(double)obstacleRate
                                                   seed:(uint64_t)seed
  NS_SWIFT_NAME(runGridPath(width:height:obstacleRate:seed:));

+ (NSDictionary<NSString *, id> *)runVMProgram:(NSString *)program
                                          seed:(uint64_t)seed
  NS_SWIFT_NAME(runVM(program:seed:));

+ (NSDictionary<NSString *, id> *)analyzeBytes:(NSData *)data
  NS_SWIFT_NAME(analyze(bytes:));

@end

NS_ASSUME_NONNULL_END
